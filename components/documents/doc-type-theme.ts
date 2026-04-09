import type { DocType } from "@/types";

export const DOC_TYPE_ICON_COLORS: Record<DocType, string> = {
  catalogue: "text-purple-500 bg-purple-50",
  datasheet: "text-blue-500 bg-blue-50",
  installation: "text-amber-500 bg-amber-50",
  user_manual: "text-emerald-500 bg-emerald-50",
};

export const DOC_TYPE_BADGE_COLORS: Record<DocType, string> = {
  catalogue: "bg-purple-50 text-purple-600 border-purple-200",
  datasheet: "bg-blue-50 text-blue-600 border-blue-200",
  installation: "bg-amber-50 text-amber-600 border-amber-200",
  user_manual: "bg-emerald-50 text-emerald-600 border-emerald-200",
};

export const DOC_TYPE_FILTER_STYLES: Record<
  DocType,
  { active: string; inactive: string }
> = {
  catalogue: {
    active: "bg-purple-50 text-purple-700 shadow-sm ring-1 ring-purple-200",
    inactive: "text-purple-600 hover:bg-purple-50 hover:text-purple-700",
  },
  datasheet: {
    active: "bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-200",
    inactive: "text-blue-600 hover:bg-blue-50 hover:text-blue-700",
  },
  installation: {
    active: "bg-amber-50 text-amber-700 shadow-sm ring-1 ring-amber-200",
    inactive: "text-amber-600 hover:bg-amber-50 hover:text-amber-700",
  },
  user_manual: {
    active: "bg-emerald-50 text-emerald-700 shadow-sm ring-1 ring-emerald-200",
    inactive: "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700",
  },
};
