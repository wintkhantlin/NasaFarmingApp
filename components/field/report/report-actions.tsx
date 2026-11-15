"use client";

import { Button } from "@/components/ui/button";
import { FlowNav } from "@/components/ui/flow-nav";
import type { AppCopy } from "@/lib/store/locale-store";

interface ReportActionsProps {
  fieldId: string;
  fieldName: string;
  t: AppCopy;
}

export function ReportActions({ fieldId, fieldName, t }: ReportActionsProps) {
  const rCopy = t.report;

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${rCopy.title}: ${fieldName}`,
          text: rCopy.subtitle,
          url: window.location.href,
        });
      } catch {
        // User cancelled share dialog or unsupported, no fake error toast
      }
    } else {
      handlePrint();
    }
  };

  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <>
      {/* Sharing is the quiet option; the one primary action (print or save) is in the bar below. */}
      {canShare ? (
        <Button variant="quiet" icon="share" onClick={handleShare} className="self-start print:hidden">
          {rCopy.share}
        </Button>
      ) : null}
      <FlowNav
        className="contents"
        back={{ label: rCopy.backToCompare, href: `/fields/${fieldId}/compare` }}
        next={{ label: rCopy.printButton, onClick: handlePrint, icon: "print" }}
      />
    </>
  );
}
