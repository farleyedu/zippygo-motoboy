import React from 'react';
import { act, create } from 'react-test-renderer';
import { listChatContacts } from '../../../services/communicationApi';
import { usePagedContacts } from '../usePagedContacts';

jest.mock('../../../services/communicationApi', () => ({ listChatContacts: jest.fn() }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const contacts = (from, count) => Array.from({ length: count }, (_, i) => ({ motoboyId: from + i, nome: `Pessoa ${from + i}`, online: false }));
let value, renderer;
function Harness({ scope, search = '', active = true }) { value = usePagedContacts(scope, search, active); return null; }
beforeEach(() => { jest.useFakeTimers(); listChatContacts.mockReset(); });
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; jest.useRealTimers(); });
async function mount(props) { await act(async () => { renderer = create(<Harness {...props} />); }); await act(async () => { jest.advanceTimersByTime(1); }); }

test('busca quinze contatos e continua com cursor, sem requisições simultâneas ou duplicatas', async () => {
  listChatContacts.mockResolvedValueOnce({ contacts: contacts(1, 15), hasMore: true, cursor: 'pagina-1' })
    .mockResolvedValueOnce({ contacts: contacts(15, 10), hasMore: false });
  await mount({ scope: 'paginacao:loja:turno' });
  expect(value.contacts).toHaveLength(15);
  await act(async () => { await Promise.all([value.loadMore(), value.loadMore()]); });
  expect(listChatContacts).toHaveBeenCalledTimes(2);
  expect(listChatContacts.mock.calls[1][0].cursor).toBe('pagina-1');
  expect(value.contacts).toHaveLength(24);
  await act(async () => { await value.loadMore(); await value.refresh(); });
  expect(listChatContacts).toHaveBeenCalledTimes(2);
});

test('busca nomes ainda não carregados após pausa curta e mantém a tela oculta sem consultas', async () => {
  listChatContacts.mockResolvedValue({ contacts: contacts(50, 1), hasMore: false });
  await mount({ scope: 'busca:loja:turno', search: 'Pessoa 50' });
  expect(listChatContacts).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(250); });
  expect(listChatContacts.mock.calls[0][0].search).toBe('Pessoa 50');
  await act(async () => { renderer.update(<Harness scope="outro:loja:turno" active={false} />); });
  await act(async () => { jest.advanceTimersByTime(60000); await value.refresh(); });
  expect(listChatContacts).toHaveBeenCalledTimes(1);
});

test('resposta atrasada não troca contatos da conta atual', async () => {
  let release;
  listChatContacts.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }))
    .mockResolvedValueOnce({ contacts: contacts(90, 1), hasMore: false });
  await mount({ scope: 'antigo:loja:turno' });
  await act(async () => { renderer.update(<Harness scope="novo:loja:turno" />); });
  await act(async () => { jest.advanceTimersByTime(1); });
  await act(async () => { release({ contacts: contacts(1, 15), hasMore: true }); });
  expect(value.contacts[0].motoboyId).toBe(90);
});
