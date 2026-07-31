#![cfg(feature = "test-support")]

#[tokio::test]
async fn default_runner_mode_never_starts_embedded_execution() {
    let pool = sqlx::SqlitePool::connect("sqlite::memory:")
        .await
        .expect("connect test database");

    let embedded = oored::embedded_runner::start_if_enabled(pool, "http://127.0.0.1:0".to_string())
        .await
        .expect("default runner mode must be safe");

    assert!(
        embedded.is_none(),
        "default mode must not start repository execution inside oored"
    );
}
