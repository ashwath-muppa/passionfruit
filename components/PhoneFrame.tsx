// Phone shell for the kid-facing surfaces (Project Paths, Weekly Plan). A dark
// device frame on warm paper, with a faux status bar. (DESIGN.md §7a/§7b)

import type { ReactNode } from "react";

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[392px]">
      <div className="rounded-[46px] bg-[#1f1a17] p-2.5 shadow-frame">
        <div className="relative overflow-hidden rounded-[36px] bg-passionfruit-paper">
          {/* status bar */}
          <div className="flex items-center justify-between px-6 pb-1.5 pt-3.5 text-[13px] font-semibold text-passionfruit-body">
            <span>9:41</span>
            <span className="tracking-[2px]">●●● ▮</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
