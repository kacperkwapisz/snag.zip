import { Zip, ZipPassThrough } from "fflate";

type ZipEntry = {
  name: string;
  stream: () => ReadableStream<Uint8Array>;
  size: number;
};

export function createZipStream(entries: ZipEntry[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      const zip = new Zip((err, data, final) => {
        if (err) {
          controller.error(err);
          return;
        }
        controller.enqueue(data);
        if (final) controller.close();
      });

      (async () => {
        try {
          for (const entry of entries) {
            const passThrough = new ZipPassThrough(entry.name);
            zip.add(passThrough);

            const reader = entry.stream().getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              passThrough.push(value, false);
            }
            passThrough.push(new Uint8Array(0), true);
          }
          zip.end();
        } catch (err) {
          controller.error(err);
        }
      })();
    },
  });
}
