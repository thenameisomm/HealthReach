export const tokens = {
  primary: "#6366F1",
  primaryHover: "#4F46E5",
  bg: "#FAFAFA",
  surface: "#FFFFFF",
  text: "#0A0A0A",
  textSecondary: "#6B6B6B",
  border: "#E8E8EC",
  muted: "#9C9C9C",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  brandMark: "#20970B",
} as const;

export type ProvenanceKind = "qloo" | "geo" | "ai" | "user" | "illustrative";

export const provenanceMeta: Record<
  ProvenanceKind,
  { label: string; icon: string; className: string; border: string }
> = {
  qloo: {
    label: "Qloo signal",
    icon: "◈",
    className: "prov-qloo",
    border: "solid",
  },
  geo: {
    label: "Verified place data",
    icon: "◎",
    className: "prov-geo",
    border: "solid",
  },
  ai: {
    label: "AI interpretation",
    icon: "✦",
    className: "prov-ai",
    border: "solid",
  },
  user: {
    label: "You provided",
    icon: "●",
    className: "prov-user",
    border: "solid",
  },
  illustrative: {
    label: "Illustrative data",
    icon: "◇",
    className: "prov-illustrative",
    border: "dashed",
  },
};
