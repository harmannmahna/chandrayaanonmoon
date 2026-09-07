"""MinIO / S3-compatible object storage helpers."""

from __future__ import annotations

import io
from functools import lru_cache
from typing import BinaryIO
from urllib.parse import urlparse, urlunparse

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from app.core.config import Settings, get_settings


class ObjectStorage:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        endpoint = self.settings.minio_endpoint
        if not endpoint.startswith("http"):
            scheme = "https" if self.settings.minio_secure else "http"
            endpoint = f"{scheme}://{endpoint}"
        self._endpoint = endpoint
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=self.settings.minio_access_key,
            aws_secret_access_key=self.settings.minio_secret_key,
            config=Config(signature_version="s3v4"),
            region_name="us-east-1",
        )
        self.bucket = self.settings.minio_bucket

    def ensure_bucket(self) -> None:
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except ClientError:
            self.client.create_bucket(Bucket=self.bucket)

    def put_bytes(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        self.ensure_bucket()
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)
        return key

    def put_fileobj(self, key: str, fileobj: BinaryIO, content_type: str = "application/octet-stream") -> str:
        self.ensure_bucket()
        self.client.upload_fileobj(
            fileobj,
            self.bucket,
            key,
            ExtraArgs={"ContentType": content_type},
        )
        return key

    def get_bytes(self, key: str) -> bytes:
        obj = self.client.get_object(Bucket=self.bucket, Key=key)
        return obj["Body"].read()

    def download_to_path(self, key: str, path: str) -> None:
        self.client.download_file(self.bucket, key, path)

    def exists(self, key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError:
            return False

    def presigned_put(self, key: str, content_type: str, expires: int | None = None) -> str:
        self.ensure_bucket()
        url = self.client.generate_presigned_url(
            "put_object",
            Params={"Bucket": self.bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=expires or self.settings.presign_expiry_seconds,
        )
        return self._rewrite_public(url)

    def presigned_get(self, key: str, expires: int | None = None) -> str:
        url = self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires or self.settings.presign_expiry_seconds,
        )
        return self._rewrite_public(url)

    def _rewrite_public(self, url: str) -> str:
        """Rewrite host for browser access when API talks to minio:9000 internally."""
        public = self.settings.minio_public_endpoint
        if not public:
            return url
        if not public.startswith("http"):
            scheme = "https" if self.settings.minio_secure else "http"
            public = f"{scheme}://{public}"
        parsed = urlparse(url)
        pub = urlparse(public)
        return urlunparse((pub.scheme, pub.netloc, parsed.path, parsed.params, parsed.query, parsed.fragment))

    def healthcheck(self) -> str:
        try:
            self.ensure_bucket()
            return "ok"
        except Exception as exc:  # noqa: BLE001
            return f"error: {exc}"


@lru_cache
def get_storage() -> ObjectStorage:
    return ObjectStorage()


def object_key_for(project_id: str, kind: str, name: str) -> str:
    safe = name.replace("..", "_").replace("/", "_")
    return f"projects/{project_id}/{kind}/{safe}"
