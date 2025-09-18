import nodemailer from 'nodemailer';

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;

// Create email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASSWORD,
  },
});

// Email templates
export const generateWelcomeEmailTemplate = (merchantData: {
  name: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  planType: 'trial' | 'vip';
  accessEndDate: Date;
}) => {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    });
  };

  const planInfo = merchantData.planType === 'trial' 
    ? {
        planName: 'Teste Grátis (10 dias)',
        description: 'Você tem acesso completo a todas as funcionalidades por 10 dias, sem custo!',
        nextSteps: 'Após os 10 dias, você poderá escolher um de nossos planos pagos para continuar usando o sistema.'
      }
    : {
        planName: 'Plano VIP (30 dias)',
        description: 'Você escolheu nosso plano premium com acesso a recursos avançados por 30 dias!',
        nextSteps: 'Finalize o pagamento para ativar completamente sua conta e começar a usar todos os recursos VIP.'
      };

  return {
    subject: `Bem-vindo ao Beauty Scheduler - ${merchantData.name}! 🎉`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bem-vindo ao Beauty Scheduler</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 0; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
          .header p { margin: 10px 0 0; font-size: 16px; opacity: 0.9; }
          .content { padding: 30px; }
          .welcome-message { background-color: #f8f9ff; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px; }
          .plan-info { background-color: ${merchantData.planType === 'vip' ? '#fff7ed' : '#f0fdf4'}; border: 1px solid ${merchantData.planType === 'vip' ? '#fed7aa' : '#bbf7d0'}; padding: 20px; margin: 20px 0; border-radius: 8px; }
          .plan-badge { display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 14px; font-weight: 600; margin-bottom: 10px; ${merchantData.planType === 'vip' ? 'background-color: #f59e0b; color: white;' : 'background-color: #10b981; color: white;'} }
          .salon-details { background-color: #f9fafb; padding: 20px; margin: 20px 0; border-radius: 8px; }
          .detail-row { display: flex; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
          .detail-row:last-child { border-bottom: none; }
          .detail-label { font-weight: 600; color: #374151; width: 120px; flex-shrink: 0; }
          .detail-value { color: #6b7280; flex: 1; }
          .cta-button { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; margin: 20px 0; transition: transform 0.2s; }
          .cta-button:hover { transform: translateY(-2px); }
          .footer { background-color: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
          .footer a { color: #667eea; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✂️ Beauty Scheduler</h1>
            <p>Sistema de Agendamento para Salões de Beleza</p>
          </div>
          
          <div class="content">
            <div class="welcome-message">
              <h2 style="margin-top: 0; color: #1f2937;">Olá, ${merchantData.ownerName}! 👋</h2>
              <p style="margin-bottom: 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Seja muito bem-vindo(a) ao <strong>Beauty Scheduler</strong>! Estamos muito felizes em ter o <strong>${merchantData.name}</strong> em nossa plataforma.
              </p>
            </div>

            <div class="plan-info">
              <div class="plan-badge">${planInfo.planName}</div>
              <h3 style="margin: 10px 0; color: #1f2937;">Seu Plano</h3>
              <p style="color: #4b5563; line-height: 1.6;">${planInfo.description}</p>
              <p style="color: #6b7280; font-size: 14px; margin-bottom: 10px;"><strong>Acesso válido até:</strong> ${formatDate(merchantData.accessEndDate)}</p>
              <p style="color: #6b7280; font-size: 14px; line-height: 1.5;">${planInfo.nextSteps}</p>
            </div>

            <div class="salon-details">
              <h3 style="margin-top: 0; color: #1f2937;">Dados do seu Salão</h3>
              <div class="detail-row">
                <div class="detail-label">Nome:</div>
                <div class="detail-value">${merchantData.name}</div>
              </div>
              <div class="detail-row">
                <div class="detail-label">Proprietário:</div>
                <div class="detail-value">${merchantData.ownerName}</div>
              </div>
              <div class="detail-row">
                <div class="detail-label">Email:</div>
                <div class="detail-value">${merchantData.email}</div>
              </div>
              <div class="detail-row">
                <div class="detail-label">Telefone:</div>
                <div class="detail-value">${merchantData.phone}</div>
              </div>
              <div class="detail-row">
                <div class="detail-label">Endereço:</div>
                <div class="detail-value">${merchantData.address}</div>
              </div>
            </div>

            <h3 style="color: #1f2937;">Primeiros Passos</h3>
            <ul style="color: #4b5563; line-height: 1.8; padding-left: 20px;">
              <li><strong>Acesse sua conta:</strong> Faça login com o email ${merchantData.email}</li>
              <li><strong>Configure seu salão:</strong> Adicione serviços, funcionários e horários de funcionamento</li>
              <li><strong>Cadastre clientes:</strong> Importe ou adicione seus clientes</li>
              <li><strong>Comece a agendar:</strong> Crie seus primeiros agendamentos</li>
              <li><strong>Explore os recursos:</strong> Descubra relatórios, promoções e muito mais</li>
            </ul>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : 'http://localhost:5000'}" class="cta-button">
                🚀 Acessar Minha Conta
              </a>
            </div>

            <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin-top: 0; color: #1e40af;">💡 Precisa de Ajuda?</h4>
              <p style="margin-bottom: 0; color: #1e40af; line-height: 1.6;">
                Nossa equipe de suporte está sempre disponível para ajudá-lo. Entre em contato conosco sempre que precisar!
              </p>
            </div>
          </div>

          <div class="footer">
            <p><strong>Beauty Scheduler</strong> - Sistema de Agendamento Profissional</p>
            <p>© 2024 Beauty Scheduler. Todos os direitos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Bem-vindo ao Beauty Scheduler - ${merchantData.name}!

Olá, ${merchantData.ownerName}!

Seja muito bem-vindo(a) ao Beauty Scheduler! Estamos muito felizes em ter o ${merchantData.name} em nossa plataforma.

SEU PLANO: ${planInfo.planName}
${planInfo.description}
Acesso válido até: ${formatDate(merchantData.accessEndDate)}

DADOS DO SEU SALÃO:
Nome: ${merchantData.name}
Proprietário: ${merchantData.ownerName}
Email: ${merchantData.email}
Telefone: ${merchantData.phone}
Endereço: ${merchantData.address}

PRIMEIROS PASSOS:
1. Acesse sua conta: Faça login com o email ${merchantData.email}
2. Configure seu salão: Adicione serviços, funcionários e horários de funcionamento
3. Cadastre clientes: Importe ou adicione seus clientes
4. Comece a agendar: Crie seus primeiros agendamentos
5. Explore os recursos: Descubra relatórios, promoções e muito mais

Acesse sua conta em: ${process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : 'http://localhost:5000'}

Precisa de ajuda? Nossa equipe de suporte está sempre disponível para ajudá-lo!

Beauty Scheduler - Sistema de Agendamento Profissional
© 2024 Beauty Scheduler. Todos os direitos reservados.
    `
  };
};

// Send welcome email function
export const sendWelcomeEmail = async (merchantData: {
  name: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  planType: 'trial' | 'vip';
  accessEndDate: Date;
}): Promise<{ success: boolean; error?: string }> => {
  try {
    if (!EMAIL_USER || !EMAIL_PASSWORD) {
      console.warn('Email credentials not configured. Skipping email send.');
      return { success: false, error: 'Email credentials not configured' };
    }

    const emailTemplate = generateWelcomeEmailTemplate(merchantData);

    const mailOptions = {
      from: `"Beauty Scheduler" <${EMAIL_USER}>`,
      to: merchantData.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    };

    console.log(`Sending welcome email to: ${merchantData.email}`);
    const result = await transporter.sendMail(mailOptions);
    console.log(`Welcome email sent successfully to ${merchantData.email}:`, result.messageId);
    
    return { success: true };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// Test email configuration
export const testEmailConfiguration = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    await transporter.verify();
    console.log('Email configuration is valid');
    return { success: true };
  } catch (error) {
    console.error('Email configuration error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};