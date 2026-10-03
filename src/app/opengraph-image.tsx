import { OG_SIZE, OG_TYPE, shareCard } from "@/lib/og";

export const alt = "13C: find and book cars from local Cebu rental businesses";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return shareCard({
    title: "Find and book cars from local Cebu rental businesses",
    lines: ["Self-drive and with-driver rentals, booked directly"],
    address: "www.13c.online",
  });
}
