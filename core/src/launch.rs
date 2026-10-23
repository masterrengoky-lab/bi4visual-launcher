//! Builds the Java command line that starts the game.

use crate::accounts::{Account, AccountKind};
use crate::manifest::{ArgValue, Argument, VersionJson};
use crate::paths::Paths;
use crate::settings::Settings;
use anyhow::{anyhow, Result};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

pub struct LaunchPlan {
    pub java: PathBuf,
    pub args: Vec<String>,
    pub game_dir: PathBuf,
}

fn classpath_separator() -> &'static str {
    if cfg!(target_os = "windows") {
        ";"
    } else {
        ":"
    }
}

/// Library jars plus the client jar, in order.
pub fn classpath(paths: &Paths, v: &VersionJson, jar: &Path) -> Vec<PathBuf> {
    let features = HashMap::new();
    let mut cp: Vec<PathBuf> = v
        .libraries
        .iter()
        .filter(|l| crate::rules::allowed(l.rules.as_deref(), &features))
        .filter(|l| l.natives.is_none() || l.downloads.as_ref().and_then(|d| d.artifact.as_ref()).is_some())
        .filter_map(|l| l.main_artifact()?.path)
        .map(|p| paths.libraries().join(p))
        .collect();
    cp.push(jar.to_path_buf());
    cp
}

fn substitute(arg: &str, vars: &HashMap<&str, String>) -> String {
    let mut out = arg.to_string();
    for (k, v) in vars {
        out = out.replace(&format!("${{{k}}}"), v);
    }
    out
}

fn expand(args: &[Argument], features: &HashMap<String, bool>) -> Vec<String> {
    let mut out = Vec::new();
    for a in args {
        match a {
            Argument::Plain(s) => out.push(s.clone()),
            Argument::Ruled { rules, value } => {
                if crate::rules::allowed(Some(rules), features) {
                    match value {
                        ArgValue::One(s) => out.push(s.clone()),
                        ArgValue::Many(v) => out.extend(v.iter().cloned()),
                    }
                }
            }
        }
    }
    out
}

pub fn build(
    paths: &Paths,
    version_id: &str,
    account: &Account,
    settings: &Settings,
    java: PathBuf,
) -> Result<LaunchPlan> {
    let v = VersionJson::load_resolved(paths, version_id)?;
    let jar_id = VersionJson::jar_id(paths, version_id)?;
    let jar = paths.version_jar(&jar_id);
    let game_dir = settings.game_dir(paths);
    std::fs::create_dir_all(&game_dir)?;

    let sep = classpath_separator();
    let cp = classpath(paths, &v, &jar)
        .iter()
        .map(|p| p.to_string_lossy().into_owned())
        .collect::<Vec<_>>()
        .join(sep);

    let asset_id = v.asset_index.as_ref().map(|a| a.id.clone()).or(v.assets.clone()).unwrap_or_else(|| "legacy".into());
    let assets_root = paths.assets();
    let legacy_assets = assets_root.join("virtual").join(&asset_id);
    if asset_id == "pre-1.6" {
        crate::install::copy_legacy_resources(paths, &asset_id, &game_dir)?;
    }
    let token = match account.kind {
        AccountKind::Microsoft => account.access_token.clone().ok_or_else(|| anyhow!("Войдите в аккаунт заново"))?,
        AccountKind::Offline => "0".into(),
    };
    let user_type = if account.kind == AccountKind::Microsoft { "msa" } else { "legacy" };
    let natives = paths.natives(version_id);
    let s = |p: &Path| p.to_string_lossy().into_owned();

    let mut vars: HashMap<&str, String> = HashMap::from([
        ("auth_player_name", account.name.clone()),
        ("version_name", version_id.to_string()),
        ("game_directory", s(&game_dir)),
        ("assets_root", s(&assets_root)),
        ("game_assets", s(&legacy_assets)),
        ("assets_index_name", asset_id.clone()),
        ("auth_uuid", account.uuid.clone()),
        ("auth_access_token", token.clone()),
        ("auth_session", format!("token:{token}:{}", account.uuid)),
        ("auth_xuid", account.xuid.clone().unwrap_or_else(|| "0".into())),
        ("clientid", crate::microsoft::client_id().unwrap_or("0").to_string()),
        ("user_type", user_type.into()),
        ("user_properties", "{}".into()),
        ("version_type", "bi4visual".into()),
        ("natives_directory", s(&natives)),
        ("launcher_name", crate::LAUNCHER_NAME.into()),
        ("launcher_version", crate::LAUNCHER_VERSION.into()),
        ("classpath", cp.clone()),
        ("classpath_separator", sep.into()),
        ("library_directory", s(&paths.libraries())),
    ]);
    let mut features = HashMap::new();
    if let (Some(w), Some(h)) = (settings.width, settings.height) {
        features.insert("has_custom_resolution".to_string(), true);
        vars.insert("resolution_width", w.to_string());
        vars.insert("resolution_height", h.to_string());
    }

    let mut args = vec![format!("-Xmx{}M", settings.memory_mb), format!("-Xms{}M", settings.memory_mb.min(1024))];
    args.extend(settings.extra_jvm_args.split_whitespace().map(String::from));

    let (jvm, game) = match &v.arguments {
        Some(a) => (expand(&a.jvm, &features), expand(&a.game, &features)),
        None => (
            vec![
                "-Djava.library.path=${natives_directory}".to_string(),
                "-cp".into(),
                "${classpath}".into(),
            ],
            v.minecraft_arguments.clone().unwrap_or_default().split_whitespace().map(String::from).collect(),
        ),
    };
    args.extend(jvm.iter().map(|a| substitute(a, &vars)));
    args.push(v.main_class.clone().ok_or_else(|| anyhow!("в версии {version_id} нет mainClass"))?);
    args.extend(game.iter().map(|a| substitute(a, &vars)));
    if settings.fullscreen {
        args.push("--fullscreen".into());
    } else if v.arguments.is_none() {
        if let (Some(w), Some(h)) = (settings.width, settings.height) {
            args.extend(["--width".into(), w.to_string(), "--height".into(), h.to_string()]);
        }
    }
    Ok(LaunchPlan { java, args, game_dir })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write(paths: &Paths, id: &str, v: serde_json::Value) {
        std::fs::create_dir_all(paths.version_dir(id)).unwrap();
        std::fs::write(paths.version_json(id), v.to_string()).unwrap();
    }

    #[test]
    fn builds_modern_command() {
        let tmp = tempfile::tempdir().unwrap();
        let paths = Paths::new(tmp.path());
        write(&paths, "1.21.1", serde_json::json!({
            "id": "1.21.1",
            "mainClass": "net.minecraft.client.main.Main",
            "assetIndex": {"id": "17", "url": "u"},
            "arguments": {
                "game": ["--username", "${auth_player_name}", "--uuid", "${auth_uuid}", "--accessToken", "${auth_access_token}",
                    {"rules": [{"action": "allow", "features": {"is_demo_user": true}}], "value": "--demo"}],
                "jvm": ["-Djava.library.path=${natives_directory}", "-cp", "${classpath}"]
            },
            "libraries": [{"name": "a:b:1", "downloads": {"artifact": {"path": "a/b/1/b-1.jar", "url": "u"}}}]
        }));
        let acc = crate::accounts::offline("Steve").unwrap();
        let plan = build(&paths, "1.21.1", &acc, &Settings::default(), "java".into()).unwrap();
        let a = &plan.args;
        assert_eq!(a[0], "-Xmx4096M");
        let main = a.iter().position(|x| x == "net.minecraft.client.main.Main").unwrap();
        assert!(a[main - 1].contains("b-1.jar") && a[main - 1].contains("1.21.1.jar"));
        assert_eq!(a[main + 2], "Steve");
        assert!(!a.contains(&"--demo".to_string()));
        assert!(!a.iter().any(|x| x.contains("${")));
    }

    #[test]
    fn builds_legacy_command() {
        let tmp = tempfile::tempdir().unwrap();
        let paths = Paths::new(tmp.path());
        write(&paths, "1.8.9", serde_json::json!({
            "id": "1.8.9",
            "mainClass": "net.minecraft.client.main.Main",
            "assets": "1.8",
            "minecraftArguments": "--username ${auth_player_name} --userProperties ${user_properties}",
            "libraries": []
        }));
        let acc = crate::accounts::offline("Alex").unwrap();
        let s = Settings { width: Some(1280), height: Some(720), ..Default::default() };
        let plan = build(&paths, "1.8.9", &acc, &s, "java".into()).unwrap();
        assert!(plan.args.iter().any(|x| x.starts_with("-Djava.library.path=")));
        assert!(plan.args.ends_with(&["--width".into(), "1280".into(), "--height".into(), "720".into()]));
        assert!(plan.args.contains(&"{}".to_string()));
    }
}
