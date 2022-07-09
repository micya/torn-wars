App is live at https://micya.github.io/torn-wars/.

Screenshot:

![screenshot](img/screenshot.png)

API notes:

- Rate-limiting: only 100 requests per minute maximum across all API keys
- Attacks API only returns 100 attacks
- Caching: Torn API will return the same response if same API is called within 30 seconds (even with different from/to filters)
