"use client";

import * as React from "react";
import { QuizNurseLogo, QuizNurseLogoProps } from "./QuizNurseLogo";

export interface LogoProps extends QuizNurseLogoProps {}

export function Logo(props: LogoProps) {
  return <QuizNurseLogo {...props} />;
}

export { QuizNurseLogo, QuizNurseSymbol } from "./QuizNurseLogo";
