export function getAppBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export function qrPageUrl(token: string) {
  return `${getAppBaseUrl()}/q/${token}`;
}
