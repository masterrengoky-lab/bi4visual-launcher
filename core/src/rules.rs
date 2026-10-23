//! Mojang's `rules` blocks, which turn libraries and arguments on or off
//! depending on the OS, the CPU and optional launcher features.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub action: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub os: Option<OsRule>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub features: Option<HashMap<String, bool>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OsRule {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub arch: Option<String>,
}

/// OS name as Mojang spells it.
pub fn os_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "osx"
    } else {
        "linux"
    }
}

pub fn is_32bit() -> bool {
    cfg!(target_pointer_width = "32")
}

fn rule_matches(rule: &Rule, features: &HashMap<String, bool>) -> bool {
    if let Some(os) = &rule.os {
        if let Some(name) = &os.name {
            if name != os_name() {
                return false;
            }
        }
        if let Some(arch) = &os.arch {
            if arch == "x86" && !is_32bit() {
                return false;
            }
        }
    }
    if let Some(required) = &rule.features {
        for (k, v) in required {
            if features.get(k).copied().unwrap_or(false) != *v {
                return false;
            }
        }
    }
    true
}

/// No rules means allowed. Otherwise the last matching rule decides.
pub fn allowed(rules: Option<&[Rule]>, features: &HashMap<String, bool>) -> bool {
    let Some(rules) = rules else { return true };
    if rules.is_empty() {
        return true;
    }
    let mut ok = false;
    for r in rules {
        if rule_matches(r, features) {
            ok = r.action == "allow";
        }
    }
    ok
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rule(action: &str, os: Option<&str>) -> Rule {
        Rule {
            action: action.into(),
            os: os.map(|n| OsRule { name: Some(n.into()), arch: None }),
            features: None,
        }
    }

    #[test]
    fn evaluates_rules() {
        let f = HashMap::new();
        assert!(allowed(None, &f));
        assert!(allowed(Some(&[rule("allow", None)]), &f));
        assert!(!allowed(Some(&[rule("allow", None), rule("disallow", Some(os_name()))]), &f));
        assert!(allowed(Some(&[rule("allow", Some(os_name()))]), &f));
        assert!(!allowed(Some(&[rule("allow", Some("nonexistent"))]), &f));

        let feat = Rule {
            action: "allow".into(),
            os: None,
            features: Some(HashMap::from([("is_demo_user".to_string(), true)])),
        };
        assert!(!allowed(Some(std::slice::from_ref(&feat)), &f));
        let on = HashMap::from([("is_demo_user".to_string(), true)]);
        assert!(allowed(Some(&[feat]), &on));
    }
}
