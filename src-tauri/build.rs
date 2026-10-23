fn main() {
    println!("cargo:rerun-if-env-changed=BI4VISUAL_MS_CLIENT_ID");
    tauri_build::build()
}
