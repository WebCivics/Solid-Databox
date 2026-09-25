use std::{fs, path::Path, process::Command};
use crate::shape::InstallProfile;

const NODE_VERSION: &str = "v24.18.0";

pub fn run(profile: &InstallProfile) -> Result<(), String> {
    if profile.node_binary_path().is_file() && compatible(&get_node_version(&profile.node_binary_path())?) {
        println!("  Using the installed private Node.js runtime");
        return Ok(());
    }
    provision(profile)?;
    let version = get_node_version(profile.node_binary_path())?;
    if !compatible(&version) { return Err(format!("The downloaded Node runtime is incompatible ({version}).")); }
    println!("  Private Node.js runtime ready ({version})");
    Ok(())
}

fn get_node_version(command: impl AsRef<std::ffi::OsStr>) -> Result<String, String> {
    let output = Command::new(command).arg("--version").output().map_err(|error| error.to_string())?;
    if !output.status.success() { return Err(String::from_utf8_lossy(&output.stderr).trim().to_owned()); }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_owned())
}

fn compatible(version: &str) -> bool { version.starts_with("v24.") }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compatible_accepts_only_node_24() {
        assert!(compatible("v24.18.0"));
        assert!(compatible("v24.0.0"));
        for version in ["v22.23.2", "v26.3.0", "v20.19.0", "", "24.18.0", "latest"] {
            assert!(!compatible(version), "{version} must be rejected");
        }
    }
}

fn provision(profile: &InstallProfile) -> Result<(), String> {
    let platform = if cfg!(target_os = "windows") { "win" } else if cfg!(target_os = "macos") { "darwin" } else if cfg!(target_os = "linux") { "linux" } else { return Err("This operating system is not supported for automatic Node provisioning.".to_owned()); };
    let architecture = if cfg!(target_arch = "x86_64") { "x64" } else if cfg!(target_arch = "aarch64") { "arm64" } else { return Err("This processor architecture is not supported for automatic Node provisioning.".to_owned()); };
    let extension = if cfg!(target_os = "windows") { "zip" } else { "tar.xz" };
    let basename = format!("node-{NODE_VERSION}-{platform}-{architecture}");
    let url = format!("https://nodejs.org/dist/{NODE_VERSION}/{basename}.{extension}");
    let runtime_parent = profile.install_dir.join("runtime");
    let node_dir = runtime_parent.join("node");
    fs::create_dir_all(&runtime_parent).map_err(|error| error.to_string())?;
    let archive = runtime_parent.join(format!("{basename}.{extension}"));
    println!("  Downloading the private Node.js runtime");
    download(&url, &archive)?;
    let sums = download_text(&format!("https://nodejs.org/dist/{NODE_VERSION}/SHASUMS256.txt"))?;
    let expected = sums.lines().find_map(|line| line.split_whitespace().collect::<Vec<_>>().get(..2).filter(|parts| parts[1] == format!("{basename}.{extension}")).map(|parts| parts[0].to_owned()))
        .ok_or_else(|| "The official checksum file did not contain the downloaded runtime.".to_owned())?;
    verify_checksum(&archive, &expected)?;
    let extraction = runtime_parent.join("node-extract");
    if extraction.exists() { fs::remove_dir_all(&extraction).map_err(|error| error.to_string())?; }
    fs::create_dir_all(&extraction).map_err(|error| error.to_string())?;
    extract(&archive, &extraction)?;
    let nested = extraction.join(&basename);
    if !nested.is_dir() { return Err("The downloaded Node archive has an unexpected layout.".to_owned()); }
    if node_dir.exists() { fs::remove_dir_all(&node_dir).map_err(|error| error.to_string())?; }
    fs::rename(nested, &node_dir).map_err(|error| format!("Could not install the Node runtime: {error}"))?;
    fs::remove_dir_all(extraction).map_err(|error| error.to_string())?;
    fs::remove_file(archive).map_err(|error| error.to_string())?;
    Ok(())
}

fn download(url: &str, destination: &Path) -> Result<(), String> {
    let response = reqwest::blocking::get(url).map_err(|error| format!("Could not download Node.js: {error}"))?;
    if !response.status().is_success() { return Err(format!("Node.js download failed with HTTP {}", response.status())); }
    fs::write(destination, response.bytes().map_err(|error| error.to_string())?).map_err(|error| error.to_string())
}
fn download_text(url: &str) -> Result<String, String> { reqwest::blocking::get(url).map_err(|error| error.to_string())?.text().map_err(|error| error.to_string()) }
fn verify_checksum(path: &Path, expected: &str) -> Result<(), String> {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new(); hasher.update(fs::read(path).map_err(|error| error.to_string())?);
    if format!("{:x}", hasher.finalize()) != expected.to_lowercase() { return Err("The Node.js download failed its checksum verification.".to_owned()); }
    Ok(())
}
fn extract(archive: &Path, target: &Path) -> Result<(), String> {
    if cfg!(target_os = "windows") {
        let file = fs::File::open(archive).map_err(|error| error.to_string())?;
        let mut zip = zip::ZipArchive::new(file).map_err(|error| error.to_string())?;
        for index in 0..zip.len() {
            let mut entry = zip.by_index(index).map_err(|error| error.to_string())?;
            let path = entry.enclosed_name().ok_or_else(|| "The Node archive contains an unsafe path.".to_owned())?.to_owned();
            let output = target.join(path);
            if entry.is_dir() { fs::create_dir_all(output).map_err(|error| error.to_string())?; }
            else { if let Some(parent) = output.parent() { fs::create_dir_all(parent).map_err(|error| error.to_string())?; } std::io::copy(&mut entry, &mut fs::File::create(output).map_err(|error| error.to_string())?).map_err(|error| error.to_string())?; }
        }
    } else {
        let file = fs::File::open(archive).map_err(|error| error.to_string())?;
        tar::Archive::new(xz2::read::XzDecoder::new(file)).unpack(target).map_err(|error| error.to_string())?;
    }
    Ok(())
}
