"use client";

import * as React from "react";
import { QuestionRendererProps } from "./types";
import { resolveNormalizedQuestionType } from "@/lib/attempts/strata-answer-adapter";
import { SingleChoiceRenderer } from "./SingleChoiceRenderer";
import { MultipleResponseRenderer } from "./MultipleResponseRenderer";
import { TrueFalseRenderer } from "./TrueFalseRenderer";
import { FillInTheBlankRenderer } from "./FillInTheBlankRenderer";
import { BlankSelectRenderer } from "./BlankSelectRenderer";
import { NumericCalculationRenderer } from "./NumericCalculationRenderer";
import { OrderedResponseRenderer } from "./OrderedResponseRenderer";
import { MatchingRenderer } from "./MatchingRenderer";
import { MatrixGridRenderer } from "./MatrixGridRenderer";
import { CaseStudyRenderer } from "./CaseStudyRenderer";
import { BowTieRenderer } from "./BowTieRenderer";
import { MultipleTrueFalseRenderer } from "./MultipleTrueFalseRenderer";
import { ImageBasedRenderer } from "./ImageBasedRenderer";
import { MultipleImageSelectionRenderer } from "./MultipleImageSelectionRenderer";
import { DragAndDropRenderer } from "./DragAndDropRenderer";
import { ExtendedResponseRenderer } from "./ExtendedResponseRenderer";
import { TabularResponseRenderer } from "./TabularResponseRenderer";
import { ShortAnswerRenderer } from "./ShortAnswerRenderer";
import { AudioBasedRenderer } from "./AudioBasedRenderer";
import { VideoBasedRenderer } from "./VideoBasedRenderer";
import { HighlightTextRenderer } from "./HighlightTextRenderer";
import { HotspotRenderer } from "./HotspotRenderer";
import { ReviewRationaleBox } from "./ReviewRationaleBox";

const OPTION_RATIONALE_BASE_TYPES = new Set([
  "matching",
  "matrixsinglechoice",
  "matrixmultipleselect",
  "matrixgrid",
  "orderingitem",
  "orderingdragdrop",
  "orderingnumber",
  "orderedresponse",
  "draganddrop",
  "multipletruefalse",
  "blankselect",
  "bowtie",
  "dynamiclabbowtie",
  "highlight",
  "multipleimage",
  "multipleimageselection",
]);

function renderBaseQuestionType(baseType: string, props: QuestionRendererProps): React.ReactNode {
  switch (baseType) {
    case "1":
    case "18":
    case "singlechoice":
    case "multiplechoice":
      return <SingleChoiceRenderer {...props} />;

    case "2":
    case "multipleselect":
    case "multipleresponse":
    case "selectallthatapply":
    case "sata":
      return <MultipleResponseRenderer {...props} />;

    case "3":
    case "truefalse":
      return <TrueFalseRenderer {...props} />;

    case "4":
    case "blankfill":
    case "fillintheblank":
    case "cloze":
      return <FillInTheBlankRenderer {...props} />;

    case "blankselect":
      return <BlankSelectRenderer {...props} />;

    case "5":
    case "numericresponse":
    case "numericcalculation":
      return <NumericCalculationRenderer {...props} />;

    case "6":
    case "orderingitem":
    case "orderingdragdrop":
    case "orderingnumber":
    case "orderedresponse":
      return <OrderedResponseRenderer {...props} />;

    case "7":
    case "matching":
      return <MatchingRenderer {...props} />;

    case "8":
    case "matrixsinglechoice":
    case "matrixmultipleselect":
    case "matrixgrid":
      return <MatrixGridRenderer {...props} />;

    case "10":
    case "bowtie":
    case "dynamiclabbowtie":
      return <BowTieRenderer {...props} />;

    case "11":
    case "multipletruefalse":
      return <MultipleTrueFalseRenderer {...props} />;

    case "12":
    case "dynamicimage":
    case "imagebased":
      return <ImageBasedRenderer {...props} />;

    case "13":
    case "multipleimage":
    case "multipleimageselection":
      return <MultipleImageSelectionRenderer {...props} />;

    case "14":
    case "draganddrop":
      return <DragAndDropRenderer {...props} />;

    case "hotspot":
      return <HotspotRenderer {...props} />;

    case "15":
    case "openended":
    case "extendedresponse":
      return <ExtendedResponseRenderer {...props} />;

    case "16":
    case "tabularresponse":
      return <TabularResponseRenderer {...props} />;

    case "17":
    case "shortanswer":
      return <ShortAnswerRenderer {...props} />;

    case "19":
    case "audiobased":
      return <AudioBasedRenderer {...props} />;

    case "20":
    case "videobased":
      return <VideoBasedRenderer {...props} />;

    case "21":
    case "highlight":
      return <HighlightTextRenderer {...props} />;

    default:
      return <SingleChoiceRenderer {...props} />;
  }
}

export const QuestionRendererRegistry: React.FC<QuestionRendererProps> = (props) => {
  const { question, isReview = false, hideRationaleBox = false } = props;
  const resolved = resolveNormalizedQuestionType(question.questionType);
  const innerProps: QuestionRendererProps = { ...props, hideRationaleBox: true };

  // Legacy numeric "9" or explicit UnfoldingCaseStudy always use CaseStudy wrapper with SingleChoice base
  const isLegacyCaseStudy =
    resolved.baseType === "9" ||
    resolved.baseType === "clinicalcasestudy" ||
    resolved.baseType === "unfoldingcasestudy";

  const content = resolved.isCaseBased || isLegacyCaseStudy ? (
    <CaseStudyRenderer {...innerProps}>
      {renderBaseQuestionType(isLegacyCaseStudy ? "singlechoice" : resolved.baseType, innerProps)}
    </CaseStudyRenderer>
  ) : (
    renderBaseQuestionType(resolved.baseType, innerProps)
  );

  return (
    <div className="space-y-4">
      {content}
      {isReview && !hideRationaleBox && (
        <ReviewRationaleBox
          question={question}
          value={props.value}
          includeOptionRationales={OPTION_RATIONALE_BASE_TYPES.has(resolved.baseType)}
          onAskTutor={props.onAskTutor}
          canAskTutor={props.canAskTutor}
        />
      )}
    </div>
  );
};
