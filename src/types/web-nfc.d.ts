interface NDEFRecord {
  recordType: string;
  mediaType?: string;
  data?: DataView;
  encoding?: string;
}

interface NDEFMessage {
  records: NDEFRecord[];
}

interface NDEFReadingEvent extends Event {
  serialNumber: string;
  message: NDEFMessage;
}

interface NDEFReader {
  scan: (options?: {signal?: AbortSignal}) => Promise<void>;
  addEventListener: (
    type: "reading" | "readingerror",
    listener: (event: NDEFReadingEvent) => void,
    options?: AddEventListenerOptions,
  ) => void;
  removeEventListener: (
    type: "reading" | "readingerror",
    listener: (event: NDEFReadingEvent) => void,
    options?: EventListenerOptions,
  ) => void;
}

interface NDEFReaderConstructor {
  new (): NDEFReader;
}

interface Window {
  NDEFReader?: NDEFReaderConstructor;
}
