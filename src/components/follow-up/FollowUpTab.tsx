import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutDashboard, List, Clock } from 'lucide-react';
import { FollowUpDashboard } from './FollowUpDashboard';
import { FollowUpSequencesList } from './FollowUpSequencesList';
import { FollowUpQueue } from './FollowUpQueue';

export function FollowUpTab() {
  const [activeSubTab, setActiveSubTab] = useState('dashboard');

  return (
    <div className="h-full flex flex-col">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="flex-1 flex flex-col">
        <div className="border-b px-6 py-4">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="sequences" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              Sequências
            </TabsTrigger>
            <TabsTrigger value="queue" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Fila
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <TabsContent value="dashboard" className="mt-0 h-full">
            <FollowUpDashboard />
          </TabsContent>

          <TabsContent value="sequences" className="mt-0 h-full">
            <FollowUpSequencesList />
          </TabsContent>

          <TabsContent value="queue" className="mt-0 h-full">
            <FollowUpQueue />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
