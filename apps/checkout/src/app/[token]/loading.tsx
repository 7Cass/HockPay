import { Card, CardContent } from '@/components/ui/card';

export default function Loading() {
  return (
    <Card>
      <CardContent className="py-12">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-10 bg-gray-200 rounded w-32 mb-6" />
          <div className="w-64 h-64 bg-gray-200 rounded-lg mb-6" />
          <div className="h-12 bg-gray-200 rounded w-full max-w-md" />
        </div>
      </CardContent>
    </Card>
  );
}
