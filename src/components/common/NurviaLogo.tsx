"use client";

import * as React from "react";
import { QuizNurseLogo, QuizNurseLogoProps } from "@/components/brand/QuizNurseLogo";

export interface NurviaLogoProps extends QuizNurseLogoProps {
  label?: string;
}

export function NurviaLogo({
  label = "QuizNurse",
  subtitle = "NURSING EXAMINATION PREPARATION",
  ...props
}: NurviaLogoProps) {
  return <QuizNurseLogo subtitle={subtitle} {...props} />;
}
