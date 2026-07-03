import httpx
import msal


class SharePointService:
    async def _get_token(self, cfg) -> str:
        authority = f"https://login.microsoftonline.com/{cfg.tenant_id}"
        app = msal.ConfidentialClientApplication(
            cfg.client_id,
            authority=authority,
            client_credential=cfg.client_secret,
        )
        result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
        if "access_token" not in result:
            error = result.get("error_description", result.get("error", "Unknown MSAL error"))
            raise RuntimeError(f"SharePoint auth failed: {error}")
        return result["access_token"]

    async def get_file_bytes(self, cfg) -> bytes:
        token = await self._get_token(cfg)
        # Build Graph API URL: drive root relative path
        url = f"https://graph.microsoft.com/v1.0/sites/{cfg.site_url}/drives/{cfg.drive_id}/root:/{cfg.file_path}:/content"
        async with httpx.AsyncClient(timeout=60) as client:
            resp = client.get(url, headers={"Authorization": f"Bearer {token}"})
            if resp.status_code != 200:
                raise RuntimeError(f"SharePoint file download failed: {resp.status_code} {resp.text}")
            return resp.content

    async def test_connection(self, cfg) -> None:
        """Verify credentials by listing drive root — raises on failure."""
        token = await self._get_token(cfg)
        url = f"https://graph.microsoft.com/v1.0/sites/{cfg.site_url}/drives/{cfg.drive_id}/root"
        async with httpx.AsyncClient(timeout=30) as client:
            resp = client.get(url, headers={"Authorization": f"Bearer {token}"})
            if resp.status_code != 200:
                raise RuntimeError(f"SharePoint connection test failed: {resp.status_code}")
