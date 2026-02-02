"use client";

import { useParams } from "next/navigation";
import { CodepairLayout } from "../../../../components/room/CodepairLayout";

export default function CodepairPage() {
  const params = useParams();
  const roomId = (params.roomId as string) || "demo";

  return (
    <div className="h-screen overflow-hidden">
      <CodepairLayout roomId={roomId} standalone />
    </div>
  );
}
