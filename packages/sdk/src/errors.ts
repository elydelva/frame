export type FrameInputErrorCode =
  | "DUPLICATE_GATE"
  | "GATE_NOT_FOUND"
  | "CONFIG_STORAGE_UNAVAILABLE"
  | "UNSUPPORTED_CONFIG_KEY"
  | "INVALID_CONFIG_VALUE";

export class FrameInputError extends Error {
  constructor(
    readonly code: FrameInputErrorCode,
    message: string
  ) {
    super(message);
    this.name = "FrameInputError";
  }
}
