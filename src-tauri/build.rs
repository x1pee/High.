fn main() {
    println!("cargo:rerun-if-env-changed=VYSHE_INSTALLED_BUILD");
    tauri_build::build()
}
