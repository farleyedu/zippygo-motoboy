import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ConfirmacaoEntrega from '../app/confirmacaoEntrega';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ statusPagamento: 'a_receber', valorTotal: '10.00' }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ setOptions: jest.fn() }),
  useFocusEffect: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
}));

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
  FontAwesome: 'FontAwesome',
}));

describe('ConfirmacaoEntrega', () => {
  it('mostra valor e métodos de pagamento ao clicar em Cobrar', () => {
    const { getAllByText, getByText } = render(<ConfirmacaoEntrega />);

    fireEvent.press(getAllByText('Cobrar')[1]);

    expect(getByText('Total: R$ 10.00')).toBeTruthy();
    expect(getByText('Dinheiro')).toBeTruthy();
  });
});

