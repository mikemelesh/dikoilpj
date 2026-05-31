export interface ManagerReplyTemplate {
  id: string;
  label: string;
  text: string;
}

export const MANAGER_REPLY_TEMPLATES: ManagerReplyTemplate[] = [
  {
    id: "confirm_standard",
    label: "Подтверждение заказа",
    text:
      "Здравствуйте! Ваш заказ {order_number} подтверждён. Итоговая сумма: {final_price}. " +
      "При необходимости уточним детали по телефону.",
  },
  {
    id: "confirm_deadline",
    label: "Подтверждение со сроком",
    text:
      "Здравствуйте! Заказ {order_number} принят в работу. Плановый срок готовности: {deadline}. " +
      "Сумма к оплате: {final_price}.",
  },
  {
    id: "price_adjusted",
    label: "Скорректирована стоимость",
    text:
      "Здравствуйте! По заказу {order_number} уточнена стоимость: {final_price}. " +
      "Заказ подтверждён, приступаем к выполнению.",
  },
  {
    id: "need_info",
    label: "Нужны уточнения",
    text:
      "Здравствуйте! По заказу {order_number} требуются уточнения по материалам/срокам. " +
      "Пожалуйста, свяжитесь с нами для согласования.",
  },
  {
    id: "urgent",
    label: "Срочный заказ",
    text:
      "Здравствуйте! Срочный заказ {order_number} подтверждён. Сумма: {final_price}. " +
      "Дедлайн: {deadline}. Держим вас в курсе статуса.",
  },
];

export function fillReplyTemplate(
  template: string,
  vars: { order_number: string; final_price: string; deadline?: string }
): string {
  return template
    .replace(/\{order_number\}/g, vars.order_number)
    .replace(/\{final_price\}/g, vars.final_price)
    .replace(/\{deadline\}/g, vars.deadline ?? "уточняется");
}
