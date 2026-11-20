# Shopify Postcode Heatmap App

**This app is no longer live or maintained.** The source is available for reference.

The app ran inside Shopify Admin and helped merchants see where their orders came from. It shades each region by the number of orders billed there within a selected date range. The maps cover UK postcode areas, postcode-based regions in France and Germany, and US states.

Merchants can choose presets such as the last 7 days or month to date, pan and zoom the map, and click a region to see its order count. They can also change the colour palette and download the map as a PNG.

## Tech stack

- **Node.js and Express** power the backend. It requests a bulk order export through GraphQL, streams the JSON Lines file using Got and Node's readline module, and counts orders in memory by billing postcode prefix or US state. The app does not write order records to its database.
- **React and Vite** power the frontend, with date-fns for date calculations.
- **D3 and TopoJSON** render interactive SVG maps from the boundary files in [web/geodata](web/geodata). **Canvg** converts the map to PNG via a browser canvas.
- **SQLite** stores app sessions in a file called `database.sqlite` in the backend's working directory.
- **Docker** packages the backend and frontend. The repository also includes a Heroku container configuration.

## Run locally

The repository targets Node.js 18 in its Dockerfile and pins Shopify CLI 3.34.0. These steps describe the original setup. Running it against Shopify today may require CLI, dependency, and Admin API updates.

1. Set up a Shopify app and a development store with test orders. The app requests the `read_orders` scope.
2. From the repository root, install dependencies and start the development CLI.

   ```sh
   npm ci
   npm ci --prefix web
   npm install --prefix web/frontend
   npm run dev
   ```

3. Follow the CLI prompts to connect the app and development store. Open the preview URL, install the app on the store, and launch it from Shopify Admin. Test orders need billing addresses in the region you select and creation dates within the selected range.

## Build and host

The [Dockerfile](Dockerfile) builds the Vite frontend and starts Express in production mode. Express serves both the API and the built frontend. The commands below illustrate the repository's original container setup.

```sh
docker build --build-arg SHOPIFY_API_KEY=your-app-api-key -t postcode-heatmap .
docker run --rm -p 8081:8081 --env-file .env.production postcode-heatmap
```

For the run command, create an untracked `.env.production` file with these settings.

| Variable | Value |
| --- | --- |
| `SHOPIFY_API_KEY` | The same app key used at build time |
| `SHOPIFY_API_SECRET` | The app secret |
| `HOST` | The public HTTPS URL for the app |
| `SCOPES` | `read_orders` |
| `PORT` | `8081` for the Docker command above, or the port assigned by the hosting platform |

On the hosting platform, route HTTPS traffic to the container port. Set the app URL to that public URL and register `/api/auth/callback` on the same origin as an allowed redirect URL. For a persistent deployment, run a single instance and keep `/app/database.sqlite` on writable persistent storage so sessions survive container replacement.

The included [heroku.yml](heroku.yml) builds the same Docker image on Heroku's container stack. If reusing it, update the build-time app key and configure the runtime variables on the host.
