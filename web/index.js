// @ts-check
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import serveStatic from "serve-static";

import shopify from "./shopify.js";
import productCreator from "./product-creator.js";
import GDPRWebhookHandlers from "./gdpr.js";
import { GraphqlQueryError } from "@shopify/shopify-api";

import got from "got";

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

// @ts-ignore
const PORT = parseInt(process.env.BACKEND_PORT || process.env.PORT, 10);

const STATIC_PATH =
  process.env.NODE_ENV === "production"
    ? `${process.cwd()}/frontend/dist`
    : `${process.cwd()}/frontend/`;

const app = express();

// Set up Shopify authentication and webhook handling
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  shopify.redirectToShopifyOrAppRoot()
);
app.post(
  shopify.config.webhooks.path,
  // @ts-ignore
  shopify.processWebhooks({ webhookHandlers: GDPRWebhookHandlers })
);

// All endpoints after this point will require an active session
app.use("/api/*", shopify.validateAuthenticatedSession());

app.use(express.json());

app.get("/api/products/count", async (_req, res) => {
  const countData = await shopify.api.rest.Product.count({
    session: res.locals.shopify.session,
  });
  res.status(200).send(countData);
});

app.get("/api/map-data", async (req, res, next) => {
  try {
    var geoJson = JSON.parse(
      fs.readFileSync(path.resolve("./geodata/postcodedistricts.json"), "utf8")
    );
    res.json(geoJson);
  } catch (ex) {
    console.error(ex);
    next({ status: 400, message: ex });
  }
});

app.get("/api/export-orders", async (req, res, next) => {
  const session = res.locals.shopify.session;
  const client = new shopify.api.clients.Graphql({ session });

  const query = `mutation {
    bulkOperationRunQuery(
     query: """
      {
        orders(query: "created_at:>=2020-01-01 AND created_at:<2023-05-01") {
          edges {
            node {
              id
              shippingAddress {
                zip
              }
            }
          }
        }
      }
      """
    ) {
      bulkOperation {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }`;

  try {
    const response = await client.query({
      data: {
        query,
      },
    });

    res.json(response.body);
  } catch (error) {
    if (error instanceof GraphqlQueryError) {
      throw new Error(
        `${error.message}\n${JSON.stringify(error.response, null, 2)}`
      );
    } else {
      throw error;
    }
  }
});

app.post("/api/check-export-status", async (req, res, next) => {
  const session = res.locals.shopify.session;
  const client = new shopify.api.clients.Graphql({ session });

  const query = `{
    node(id: "${req.body.id}") {
      ... on BulkOperation {
        id
        status
        errorCode
        createdAt
        completedAt
        objectCount
        fileSize
        url
        partialDataUrl
      }
    }
  }`;

  try {
    const response = await client.query({
      data: {
        query,
      },
    });

    res.json(response.body);
  } catch (error) {
    if (error instanceof GraphqlQueryError) {
      throw new Error(
        `${error.message}\n${JSON.stringify(error.response, null, 2)}`
      );
    } else {
      throw error;
    }
  }
});

app.post("/api/stream", async (req, res) => {
  const getDistrictCode = (postcode) => {
    const trimmedPostcode = postcode.replace(/\s+/g, "");
    const districtCode = trimmedPostcode.substring(0, 2).trim();
    if (!isNaN(parseInt(districtCode.split("")[1]))) {
      return trimmedPostcode.substring(0, 1).trim();
    }

    return districtCode;
  };

  const rl = readline.createInterface({
    input: got.stream(req.body.url),
  });

  let results = {};

  for await (const line of rl) {
    const parsedData = JSON.parse(line);

    const postcode = parsedData?.shippingAddress?.zip;

    if (postcode !== null && postcode !== undefined) {
      const districtCode = getDistrictCode(postcode);
      if (results[districtCode] === undefined) {
        results[districtCode] = 1;
      } else {
        results.districtCode = results[districtCode] + 1;
      }
    }
  }

  return res.json(results);
});

app.get("/api/products/create", async (_req, res) => {
  let status = 200;
  let error = null;

  try {
    await productCreator(res.locals.shopify.session);
  } catch (e) {
    console.log(`Failed to process products/create: ${e.message}`);
    status = 500;
    error = e.message;
  }
  res.status(status).send({ success: status === 200, error });
});

app.use(serveStatic(STATIC_PATH, { index: false }));

// eslint-disable-next-line no-unused-vars
app.use("/*", shopify.ensureInstalledOnShop(), async (_req, res, _next) => {
  return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(readFileSync(join(STATIC_PATH, "index.html")));
});

app.listen(PORT);
