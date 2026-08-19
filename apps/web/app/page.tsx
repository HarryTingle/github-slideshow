import { redirect } from 'next/navigation';

/**
 * The app opens where the work starts.
 *
 * Overview is a summary of a model that has been built, so it reads last and it reads
 * only — it has nothing to offer someone who has just arrived.
 */
export default function Home() {
  redirect('/plan');
}
