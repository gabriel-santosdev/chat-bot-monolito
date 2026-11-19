import { Center, Loader } from '@mantine/core';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { ChatProvider } from '@/chat/ChatProvider';
import { AuthScreen } from '@/components/AuthScreen/AuthScreen';
import { ChatLayout } from '@/components/ChatLayout/ChatLayout';

function Root() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <Center h="100dvh">
        <Loader />
      </Center>
    );
  }

  if (status === 'anonymous') return <AuthScreen />;

  return (
    <ChatProvider>
      <ChatLayout />
    </ChatProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
