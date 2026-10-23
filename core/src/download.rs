//! Parallel file downloads with SHA-1 checks and retries.

use crate::{paths::ensure_parent, Progress, ProgressFn};
use anyhow::{bail, Context, Result};
use futures::{StreamExt, TryStreamExt};
use sha1::{Digest, Sha1};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::io::AsyncWriteExt;

const PARALLEL: usize = 16;
const RETRIES: usize = 3;

#[derive(Debug, Clone)]
pub struct Job {
    pub url: String,
    pub dest: PathBuf,
    pub sha1: Option<String>,
}

pub fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(concat!("bi4visual-launcher/", env!("CARGO_PKG_VERSION")))
        .connect_timeout(std::time::Duration::from_secs(15))
        .build()
        .expect("http client")
}

pub fn sha1_file(path: &Path) -> Result<String> {
    let mut f = std::fs::File::open(path)?;
    let mut h = Sha1::new();
    std::io::copy(&mut f, &mut h)?;
    Ok(hex::encode(h.finalize()))
}

/// A file is up to date when it exists and, if a hash is known, matches it.
pub fn is_valid(path: &Path, sha1: Option<&str>) -> bool {
    if !path.is_file() {
        return false;
    }
    match sha1 {
        Some(want) => sha1_file(path).map(|h| h.eq_ignore_ascii_case(want)).unwrap_or(false),
        None => true,
    }
}

async fn fetch_once(client: &reqwest::Client, job: &Job) -> Result<()> {
    ensure_parent(&job.dest)?;
    let tmp = job.dest.with_extension("part");
    let resp = client.get(&job.url).send().await?.error_for_status()?;
    let mut file = tokio::fs::File::create(&tmp).await?;
    let mut hasher = Sha1::new();
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        hasher.update(&chunk);
        file.write_all(&chunk).await?;
    }
    file.flush().await?;
    drop(file);
    if let Some(want) = &job.sha1 {
        let got = hex::encode(hasher.finalize());
        if !got.eq_ignore_ascii_case(want) {
            let _ = tokio::fs::remove_file(&tmp).await;
            bail!("контрольная сумма не совпала для {}", job.url);
        }
    }
    tokio::fs::rename(&tmp, &job.dest).await?;
    Ok(())
}

pub async fn fetch(client: &reqwest::Client, job: &Job) -> Result<()> {
    let mut last = None;
    for attempt in 0..RETRIES {
        match fetch_once(client, job).await {
            Ok(()) => return Ok(()),
            Err(e) => {
                last = Some(e);
                tokio::time::sleep(std::time::Duration::from_millis(500 * (attempt as u64 + 1))).await;
            }
        }
    }
    Err(last.unwrap()).with_context(|| format!("не удалось скачать {}", job.url))
}

/// Downloads every job that is missing or broken, reporting progress under `stage`.
pub async fn fetch_all(
    client: &reqwest::Client,
    jobs: Vec<Job>,
    stage: &str,
    progress: &ProgressFn,
) -> Result<()> {
    let jobs: Vec<Job> = tokio::task::spawn_blocking(move || {
        jobs.into_iter()
            .filter(|j| !is_valid(&j.dest, j.sha1.as_deref()))
            .collect()
    })
    .await?;
    let total = jobs.len() as u64;
    let done = Arc::new(AtomicU64::new(0));
    progress(Progress { stage: stage.into(), done: 0, total });
    futures::stream::iter(jobs)
        .map(|job| {
            let done = done.clone();
            async move {
                fetch(client, &job).await?;
                let n = done.fetch_add(1, Ordering::Relaxed) + 1;
                progress(Progress { stage: stage.into(), done: n, total });
                Ok::<_, anyhow::Error>(())
            }
        })
        .buffer_unordered(PARALLEL)
        .try_collect::<()>()
        .await
}

pub async fn get_json<T: serde::de::DeserializeOwned>(client: &reqwest::Client, url: &str) -> Result<T> {
    client
        .get(url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await
        .with_context(|| format!("неверный ответ от {url}"))
}
