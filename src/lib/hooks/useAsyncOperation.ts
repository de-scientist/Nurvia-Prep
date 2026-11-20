"use client";

import * as React from "react";

export type AsyncStatus = "idle" | "loading" | "success" | "error";

export interface AsyncOperationState<T> {
  status: AsyncStatus;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  data: T | null;
  error: string | null;
}

export interface UseAsyncOperationOptions<T> {
  initialData?: T | null;
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
}

export function useAsyncOperation<T = unknown>(
  asyncFn: (...args: any[]) => Promise<T>,
  options: UseAsyncOperationOptions<T> = {}
) {
  const { initialData = null, onSuccess, onError } = options;

  const [state, setState] = React.useState<AsyncOperationState<T>>({
    status: "idle",
    isLoading: false,
    isSuccess: false,
    isError: false,
    data: initialData,
    error: null,
  });

  const isMountedRef = React.useRef(true);
  const activeExecutionIdRef = React.useRef(0);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const execute = React.useCallback(
    async (...args: any[]): Promise<T | null> => {
      // Abort any existing in-flight controller
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const currentExecutionId = ++activeExecutionIdRef.current;

      setState((prev) => ({
        ...prev,
        status: "loading",
        isLoading: true,
        isSuccess: false,
        isError: false,
        error: null,
      }));

      try {
        const result = await asyncFn(...args);

        // Prevent stale responses from overwriting newer executions
        if (currentExecutionId !== activeExecutionIdRef.current || !isMountedRef.current) {
          return null;
        }

        setState({
          status: "success",
          isLoading: false,
          isSuccess: true,
          isError: false,
          data: result,
          error: null,
        });

        if (onSuccess) {
          onSuccess(result);
        }
        return result;
      } catch (err: unknown) {
        if (currentExecutionId !== activeExecutionIdRef.current || !isMountedRef.current) {
          return null;
        }

        const errorMessage =
          err instanceof Error
            ? err.message
            : typeof err === "string"
            ? err
            : "An unexpected error occurred.";

        setState((prev) => ({
          ...prev,
          status: "error",
          isLoading: false,
          isSuccess: false,
          isError: true,
          error: errorMessage,
        }));

        if (onError) {
          onError(errorMessage);
        }
        return null;
      }
    },
    [asyncFn, onSuccess, onError]
  );

  const reset = React.useCallback(() => {
    if (!isMountedRef.current) return;
    setState({
      status: "idle",
      isLoading: false,
      isSuccess: false,
      isError: false,
      data: initialData,
      error: null,
    });
  }, [initialData]);

  const setData = React.useCallback((data: T) => {
    if (!isMountedRef.current) return;
    setState((prev) => ({ ...prev, data }));
  }, []);

  return {
    ...state,
    execute,
    reset,
    setData,
  };
}
