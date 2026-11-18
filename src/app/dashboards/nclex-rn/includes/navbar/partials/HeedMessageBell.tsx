"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useRelativeHeedMessage } from "@/lib/hooks/users/heed/relative/useRelativeHeedMessage";

const HeedMessageBell: React.FC = () => {
  const { messages } = useRelativeHeedMessage({
    items: 100,
    clientStatus: "Unread",
    pollMs: 60_000,
  });
  const unreadCount = messages.length;

  return (
    <Link
      href="/pages/heed/relative"
      aria-label={unreadCount > 0 ? `${unreadCount} new messages` : "Messages"}
      title={unreadCount > 0 ? `${unreadCount} new message${unreadCount === 1 ? "" : "s"}` : "Messages"}
      className="relative flex items-center justify-center w-9 h-9 lg:w-10 lg:h-10 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-[#0D9488] hover:text-[#0D9488] transition"
    >
      <Bell className="w-4.5 h-4.5" strokeWidth={2.2} />
      {unreadCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#0D9488] text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
};

export default HeedMessageBell;