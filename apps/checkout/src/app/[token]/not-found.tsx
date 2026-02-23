import { Card, CardContent } from '@/components/ui/card';
import { SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <Card>
      <CardContent className="py-12">
        <div className="flex flex-col items-center text-center">
          <SearchX className="w-16 h-16 text-gray-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Checkout não encontrado</h2>
          <p className="text-gray-600">
            Este link de pagamento não existe ou expirou.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
