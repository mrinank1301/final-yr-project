import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Video Room | Meet",
  description: "Join a video meeting",
};

export default function RoomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

