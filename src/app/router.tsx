import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router';
import { TabLayout } from './TabLayout';
import { HomePage } from '@/pages/Home';

/*
 * Route map. The four tab roots plus lesson/subject drill-downs.
 * Heavy or rarely-visited routes (player, admin) are lazy-loaded to keep the
 * initial chunk small on low-end devices.
 */

const SubjectPage = lazy(() =>
  import('@/pages/Subject').then((m) => ({ default: m.SubjectPage })),
);
const TopicPage = lazy(() =>
  import('@/pages/Topic').then((m) => ({ default: m.TopicPage })),
);
const LessonPage = lazy(() =>
  import('@/pages/Lesson').then((m) => ({ default: m.LessonPage })),
);
const DownloadsPage = lazy(() =>
  import('@/pages/Downloads').then((m) => ({ default: m.DownloadsPage })),
);
const SearchPage = lazy(() =>
  import('@/pages/Search').then((m) => ({ default: m.SearchPage })),
);
const ProgressPage = lazy(() =>
  import('@/pages/Progress').then((m) => ({ default: m.ProgressPage })),
);
const CareersPage = lazy(() =>
  import('@/pages/Careers').then((m) => ({ default: m.CareersPage })),
);
const CareerArticlePage = lazy(() =>
  import('@/pages/CareerArticle').then((m) => ({
    default: m.CareerArticlePage,
  })),
);
const AdminUploadPage = lazy(() =>
  import('@/pages/admin/Upload').then((m) => ({ default: m.AdminUploadPage })),
);
const AdminManageVideosPage = lazy(() =>
  import('@/pages/admin/ManageVideos').then((m) => ({
    default: m.AdminManageVideosPage,
  })),
);

function page(el: React.ReactNode) {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-ink-faint">Loading…</div>
      }
    >
      {el}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <TabLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'search', element: page(<SearchPage />) },
      { path: 'downloads', element: page(<DownloadsPage />) },
      { path: 'progress', element: page(<ProgressPage />) },
      {
        path: 'g/:grade/s/:subjectId',
        element: page(<SubjectPage />),
      },
      {
        path: 'g/:grade/s/:subjectId/t/:term/topic/:topicSlug',
        element: page(<TopicPage />),
      },
      { path: 'lesson/:lessonId', element: page(<LessonPage />) },
      { path: 'careers', element: page(<CareersPage />) },
      { path: 'careers/:slug', element: page(<CareerArticlePage />) },
      { path: 'admin-tools/upload', element: page(<AdminUploadPage />) },
      { path: 'admin-tools/manage', element: page(<AdminManageVideosPage />) },
    ],
  },
]);
