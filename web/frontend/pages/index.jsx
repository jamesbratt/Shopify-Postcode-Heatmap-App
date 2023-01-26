import React, { useRef, useState } from "react";

import { Card, Page, Layout, Select, Button } from "@shopify/polaris";

import { TitleBar } from "@shopify/app-bridge-react";

import UkPostcodeMap from "../components/UkPostcodeMap";

import { useAuthenticatedFetch } from "../hooks";

export default function HomePage() {
  const mapContainerRef = useRef();
  const fetch = useAuthenticatedFetch();

  const [isLoading, setIsLoading] = useState(false);

  const getMapDimensions = () => {
    return mapContainerRef.current
      ? {
          width: mapContainerRef.current.offsetWidth,
          height: mapContainerRef.current.offsetWidth,
        }
      : { width: 0, height: 0 };
  };

  const readFromStream = async (url) => {
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
  };

  const checkBulkOperation = (bulkOperationId) => {
    let timer;
    const poll = async () => {
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

      if (jsonResponse.data.node.status === "COMPLETED") {
        clearTimeout(timer);
        readFromStream(jsonResponse.data.node.url);
      } else {
        timer = setTimeout(poll, 10000);
      }
    };

    poll();
  };

  const onChange = async () => {
    setIsLoading(true);
    const response = await fetch("/api/export-orders");
    const jsonResponse = await response.json();

    checkBulkOperation(
      jsonResponse.data.bulkOperationRunQuery.bulkOperation.id
    );
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
        <Layout.Section>
          <Card title="UK Order Density by Postcode District" sectioned>
            <div ref={mapContainerRef}>
              <UkPostcodeMap getMapDimensions={getMapDimensions} />
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
