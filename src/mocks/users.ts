export interface MockUser {
  id: string;
  nome: string;
  email: string;
  senha: string;
  role: 'pizzaria' | 'motoboy';
  telefone?: string;
}

export const mockUsers: MockUser[] = [
  {
    id: '1',
    nome: 'Admin Pizzaria',
    email: 'admin@zippygo.com',
    senha: 'Teste@12345',
    role: 'pizzaria',
    telefone: '(11) 99999-9999'
  },
  {
    id: '2',
    nome: 'Natan Motoboy',
    email: 'natan@zippygo.com',
    senha: 'Teste@12345',
    role: 'motoboy',
    telefone: '(11) 88888-8888'
  }
];

export const validateUser = (email: string, senha: string): MockUser | null => {
  const user = mockUsers.find(u => u.email === email && u.senha === senha);
  return user || null;
};