import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 20,
  duration: "30s",

  thresholds: {
    http_req_duration: ["p(95)<500"],
    checks: ["rate>0.95"],
  },
};

export default function () {
  const listingId = "ff3c0945-9dca-4262-981b-001c8f21b021";

  const res = http.get(`http://localhost:8080/public/listings/${listingId}`);

  check(res, {
    "status is 200": (r) => r.status === 200,
    "response contains listing": (r) => r.json("listing.id") === listingId,
  });

  sleep(1);
}
