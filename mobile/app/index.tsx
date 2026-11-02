import { View } from 'react-native';
import { Loading } from '@/ui/states';

/** Boot: o guarda da sessao (`_layout`) leva para entrar, abas, atualizacao ou sem conexao. */
export default function Index() {
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <Loading />
    </View>
  );
}
