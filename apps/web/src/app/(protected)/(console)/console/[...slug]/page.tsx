import { notFound } from 'next/navigation';

/** Sends unknown console paths to the console's own not-found page, inside the shell. */
export default function ConsoleCatchAllPage() {
  notFound();
}
