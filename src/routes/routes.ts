import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { compare } from 'bcrypt';
import bcrypt from 'bcrypt';
import { sign } from 'jsonwebtoken';
import { authenticateUser } from '../middlewares/authUser';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const answerSchema = z.object({
  questionId: z.string(),
  userId: z.string(),
  match: z.boolean(),
});
const prisma = new PrismaClient();

export async function appRoutes(app: FastifyInstance) {

  // -- rota para postar resposta
  app.post('/answers', async (request, reply) => {
      try {
        const { questionId, userId, match } = answerSchema.parse(request.body);
    
        const newAnswer = await prisma.answer.create({
          data: {
            questionId,
            userId,
            Match: match,
          },
        });
    
        reply.code(201).send(newAnswer);
      } catch (error) {
        console.error(error);
        reply.code(500).send('Erro ao criar uma nova resposta.');
      }
  });


  // -- rota de autenticacao
  app.post('/login', async (request) => {
      const getUser = z.object({
        email: z.string(),
        password: z.string()
      });
      const { email, password } = getUser.parse(request.body);
      const user = await prisma.user.findFirst({
        where: {
          email: email,
        }
      });
    
      if (!user) {
        return 'login não cadastrado';
      }
    
      const passwordMatch = await compare(password, user.password);
    
      if (passwordMatch) {
        // Senha está correta, gerar um token de acesso para o user

        const token = sign({ user: user.email }, process.env.JWT_SECRET!);
    
        return {
          message: 'login efetuado com sucesso',
          token: token,
        };
      } else {
        return 'usuário ou senha incorretos';
      }
  });

  // -- rota para registro de usuario
  app.post('/register', async (request) => {
    const registerUserBody = z.object({
      email: z.string().email(),
      password: z.string().min(6),
    });

    const { email, password } = registerUserBody.parse(request.body);

    // Verificar se o email já está cadastrado no banco de dados
    const existingUser = await prisma.user.findUnique({
      where: {
        email: email
      },
    });

    if (existingUser) {
      return 'Este email já está cadastrado. Por favor, escolha outro email.';
    }

    // Criar um hash da senha usando o bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // Criar o novo usuário no banco de dados

    const newUser = await prisma.user.create({
      data: {
        email: email,
        password: hashedPassword,
      },
    });

    const token = sign({ userId: newUser.id, email: newUser.email }, process.env.JWT_SECRET!);

    return {
      message: 'Registro concluído com sucesso!',
      token: token,
    };
  });

  app.get('/test', async (request, reply) => {
    return 'Servidor em funcionamento!';
  });

  app.get('/protected', { preHandler: authenticateUser }, async (request, reply) => {
    return 'Servidor em funcionamento!';
  });

}

