// @ts-check
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import serveStatic from "serve-static";

import shopify from "./shopify.js";
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

app.post("/api/customers/data_request", async (req, res) => {
  res.status(200).send();
});

app.post("/api/customers/redact", async (req, res) => {
  res.status(200).send();
});

app.post("/api/shop/redact", async (req, res) => {
  res.status(200).send();
});

// All endpoints after this point will require an active session
app.use("/api/*", shopify.validateAuthenticatedSession());

app.use(express.json());

app.post("/api/map-data", async (req, res, next) => {
  const mapType = req.body.mapType;

  const mapData = {
    UK: "./geodata/postcodedistricts.json",
    US: "./geodata/usstates.json",
    FRANCE: "./geodata/frenchprovinces.json",
    GERMANY: "./geodata/germanpostcodedistricts.json",
  };

  try {
    var geoJson = JSON.parse(
      fs.readFileSync(path.resolve(mapData[mapType]), "utf8")
    );
    res.json(geoJson);
  } catch (ex) {
    console.error(ex);
    next({ status: 400, message: ex });
  }
});

app.post("/api/export-orders", async (req, res) => {
  const session = res.locals.shopify.session;
  const client = new shopify.api.clients.Graphql({ session });

  const after = req.body.after;
  const before = req.body.before;

  const query = `mutation {
    bulkOperationRunQuery(
     query: """
      {
        orders(query: "created_at:>='${after}' AND created_at:<'${before}'") {
          edges {
            node {
              id
              billingAddress {
                zip
                provinceCode
                country
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
      res.status(400).send({ success: false, error: error.message });
    } else {
      res
        .status(500)
        .send({ success: false, error: "An unexpected error has occured" });
    }
  }
});

app.post("/api/cancel-bulk-operation", async (req, res) => {
  const session = res.locals.shopify.session;
  const client = new shopify.api.clients.Graphql({ session });

  const operationId = req.body.id;

  const query = `mutation {
    bulkOperationCancel(id: "${operationId}") {
      bulkOperation {
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
      res.status(400).send({ success: false, error: error.message });
    } else {
      res
        .status(500)
        .send({ success: false, error: "An unexpected error has occured" });
    }
  }
});

app.post("/api/check-export-status", async (req, res) => {
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
      res.status(400).send({ success: false, error: error.message });
    } else {
      res
        .status(500)
        .send({ success: false, error: "An unexpected error has occured" });
    }
  }
});

const aggregateFrancePostcodeDistricts = async (rl) => {
  const getDistrictCode = (postcode) => {
    const trimmedPostcode = postcode.replace(/\s+/g, "");
    const districtCode = trimmedPostcode.substring(0, 2).trim();
    return districtCode;
  };

  let results = {};

  for await (const line of rl) {
    const parsedData = JSON.parse(line);

    const country = parsedData?.billingAddress?.country;

    if (country === "France") {
      const postcode = parsedData?.billingAddress?.zip;

      if (postcode !== null && postcode !== undefined) {
        const districtCode = getDistrictCode(postcode);
        if (results[districtCode] === undefined) {
          results[districtCode] = 1;
        } else {
          results[districtCode] = results[districtCode] + 1;
        }
      }
    }
  }
  return results;
};

const aggregateGermanyPostcodeDistricts = async (rl) => {
  const getDistrictCode = (postcode) => {
    const trimmedPostcode = postcode.replace(/\s+/g, "");
    const districtCode = trimmedPostcode.substring(0, 2).trim();
    return districtCode;
  };

  let results = {};

  for await (const line of rl) {
    const parsedData = JSON.parse(line);

    const country = parsedData?.billingAddress?.country;

    if (country === "Germany") {
      const postcode = parsedData?.billingAddress?.zip;

      if (postcode !== null && postcode !== undefined) {
        const districtCode = getDistrictCode(postcode);
        if (results[districtCode] === undefined) {
          results[districtCode] = 1;
        } else {
          results[districtCode] = results[districtCode] + 1;
        }
      }
    }
  }
  return results;
};

const aggregateUkPostcodeDitricts = async (rl) => {
  const getDistrictCode = (postcode) => {
    const trimmedPostcode = postcode.replace(/\s+/g, "");
    const districtCode = trimmedPostcode.substring(0, 2).trim();
    if (!isNaN(parseInt(districtCode.split("")[1]))) {
      return trimmedPostcode.substring(0, 1).trim();
    }

    return districtCode;
  };

  let results = {};

  for await (const line of rl) {
    const parsedData = JSON.parse(line);

    const country = parsedData?.billingAddress?.country;

    if (country === "United Kingdom") {
      const postcode = parsedData?.billingAddress?.zip;

      if (postcode !== null && postcode !== undefined) {
        const districtCode = getDistrictCode(postcode);
        if (results[districtCode] === undefined) {
          results[districtCode] = 1;
        } else {
          results[districtCode] = results[districtCode] + 1;
        }
      }
    }
  }
  return results;
};

const aggregateUsStates = async (rl) => {
  let results = {};

  for await (const line of rl) {
    const parsedData = JSON.parse(line);
    const country = parsedData?.billingAddress?.country;

    if (country === "United States") {
      const provinceCode = parsedData?.billingAddress?.provinceCode;

      if (provinceCode !== null && provinceCode !== undefined) {
        if (results[provinceCode] === undefined) {
          results[provinceCode] = 1;
        } else {
          results[provinceCode] = results[provinceCode] + 1;
        }
      }
    }
  }
  return results;
};

app.post("/api/stream", async (req, res) => {
  const mapType = req.body.mapType;

  const rl = readline.createInterface({
    input: got.stream(req.body.url),
  });

  let results = null;
  if (mapType === "UK") {
    results = await aggregateUkPostcodeDitricts(rl);
  }

  if (mapType === "US") {
    results = await aggregateUsStates(rl);
  }

  if (mapType === "FRANCE") {
    results = await aggregateFrancePostcodeDistricts(rl);
  }

  if (mapType === "GERMANY") {
    results = await aggregateGermanyPostcodeDistricts(rl);
  }

  return res.json(results);
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
