import { Suspense } from "react";
import DeckView from "./DeckView";

// The lecture id is in the query string (/deck?id=…) so the site can be exported as static files.
export default function DeckPage() {
  return (
    <Suspense fallback={<span className="spinner" />}>
      <DeckView />
    </Suspense>
  );
}
