import Heatmap from "../components/Heatmap";
import { Page, Layout } from "@shopify/polaris";

import { TitleBar } from "@shopify/app-bridge-react";

export default function UsHeatmap() {
  return (
    <Page>
      <TitleBar title="US States" primaryAction={null} />
      <Layout>
        <Heatmap />
      </Layout>
    </Page>
  );
}
