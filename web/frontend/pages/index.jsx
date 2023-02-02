import React, { useRef, useState } from "react";

import {
  Card,
  Page,
  Layout,
  Select,
  Button,
  Spinner,
  Banner,
} from "@shopify/polaris";

import { TitleBar } from "@shopify/app-bridge-react";

import UkPostcodeMap from "../components/UkPostcodeMap";

import { useAuthenticatedFetch } from "../hooks";

const SERVER_ERROR_MESSAGE =
  "We are really sorry. Something unexpected has gone wrong retreiving your order data. Please try again.";

export default function HomePage() {
  const mapContainerRef = useRef();
  const fetch = useAuthenticatedFetch();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [postcodeData, setPostcodeData] = useState(null);

  const getMapDimensions = () => {
    return mapContainerRef.current
      ? {
          width: mapContainerRef.current.offsetWidth,
          height: mapContainerRef.current.offsetWidth,
        }
      : { width: 0, height: 0 };
  };

  const readFromStream = async (url) => {
    try {
      const response = await fetch("/api/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
        }),
      });
      const jsonResponse = await response.json();
      setPostcodeData(jsonResponse);
      setIsLoading(false);
    } catch ({ message }) {
      console.error(message);
      setError(SERVER_ERROR_MESSAGE);
      setIsLoading(false);
    }
  };

  const checkBulkOperation = (bulkOperationId) => {
    let timer;
    const poll = async () => {
      try {
        const response = await fetch("/api/check-export-status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: bulkOperationId,
          }),
        });
        const jsonResponse = await response.json();

        if (
          jsonResponse.data.node.status === "COMPLETED" &&
          jsonResponse.data.node.url
        ) {
          clearTimeout(timer);
          readFromStream(jsonResponse.data.node.url);
        } else if (
          jsonResponse.data.node.status === "COMPLETED" &&
          !jsonResponse.data.node.url
        ) {
          clearTimeout(timer);
          setIsLoading(false);
        } else if (jsonResponse.data.node.status === "FAILED") {
          clearTimeout(timer);
          setIsLoading(false);
          throw Error(SERVER_ERROR_MESSAGE);
        } else {
          timer = setTimeout(poll, 10000);
        }
      } catch ({ message }) {
        console.error(message);
        setError(SERVER_ERROR_MESSAGE);
        setIsLoading(false);
      }
    };

    poll();
  };

  const onChange = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/export-orders");
      const jsonResponse = await response.json();

      const bulkOperationId =
        jsonResponse?.data?.bulkOperationRunQuery?.bulkOperation?.id;

      if (!bulkOperationId) {
        throw Error("No bulk operation ID was created");
      }

      checkBulkOperation(
        jsonResponse.data.bulkOperationRunQuery.bulkOperation.id
      );
    } catch ({ message }) {
      console.error(message);
      setError(SERVER_ERROR_MESSAGE);
      setIsLoading(false);
    }
  };

  const options = [
    { label: "Today", value: "today" },
    { label: "Yesterday", value: "yesterday" },
    { label: "Last 24 hours", value: "last24hours" },
    { label: "Last 7 days", value: "lastWeek" },
    { label: "Last 30 days", value: "last30days" },
    { label: "Month to date", value: "monthtodate" },
  ];

  const colorOptions = [
    { label: "Green", value: "GREEN" },
    { label: "Blue", value: "BLUE" },
    { label: "Red", value: "RED" },
    { label: "Orange", value: "ORANGE" },
    { label: "Purple", value: "PURPLE" },
    { label: "Grey", value: "GREY" },
  ];

  return (
    <Page>
      <TitleBar title="UK Customer Heatmap" primaryAction={null} />
      <Layout>
        {error && (
          <Layout.Section>
            <Banner
              title="We were unable to retrieve your order data"
              action={{ content: "Try Again", onAction: onChange }}
              status="critical"
            >
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        )}
        <Layout.Section>
          <Card title="UK Order Density by Postcode District" sectioned>
            <div ref={mapContainerRef}>
              {isLoading ? (
                <Spinner accessibilityLabel="Spinner example" size="large" />
              ) : (
                <UkPostcodeMap
                  getMapDimensions={getMapDimensions}
                  postcodeData={postcodeData}
                />
              )}
            </div>
          </Card>
        </Layout.Section>
        <Layout.Section secondary>
          <Card title="Retrieve Order Data" sectioned>
            <Select
              label="Date Range"
              options={options}
              onChange={onChange}
              value={"today"}
            />
          </Card>
          <Card title="Configure Heatmap Display" sectioned>
            <Select
              label="Map Colour"
              options={colorOptions}
              onChange={() => {}}
              value={"GREEN"}
            />
          </Card>
          <Card title="Export Heatmap" sectioned>
            <Button primary>Download .PNG Image</Button>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
