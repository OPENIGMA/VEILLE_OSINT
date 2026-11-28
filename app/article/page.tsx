import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ArticleView } from './article-view';
import { TerminalLoader } from '@/components/ui/terminal-loader';

export const metadata: Metadata = { title: 'Article' };

export default function ArticlePage() {
  return (
    <Suspense fallback={<TerminalLoader label="Chargement de l'article" />}>
      <ArticleView />
    </Suspense>
  );
}
