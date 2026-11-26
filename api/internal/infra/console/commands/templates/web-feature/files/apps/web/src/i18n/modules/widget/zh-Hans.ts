import type { LocaleMessageShape } from '../../locale-message-shape';
import type { WidgetMessages } from './en-US';

const messages = {
  title: 'Widgets',
  description: '本组织的 Widgets。组织所有者和管理员可以创建和修改。',
  fields: {
    organization: '组织',
    name: '名称',
    namePlaceholder: '简短、易识别的名称',
  },
  list: {
    title: 'Widgets',
    updated: '更新于 {time}',
    page: '第 {page} 页，共 {pages} 页',
  },
  editor: {
    createTitle: '新建 Widget',
    editTitle: '重命名 Widget',
    description: '组织内的所有成员都可以看到它。',
  },
  delete: {
    title: '删除 Widget',
    description: '确定删除"{name}"吗？此操作无法撤销。',
  },
  empty: {
    noOrganizationTitle: '还没有组织',
    noOrganization: '创建或加入一个组织后即可使用。',
    noWidgetsTitle: '还没有 Widget',
    noWidgets: '在本组织创建的 Widget 会显示在这里。',
  },
  actions: {
    create: '新建 Widget',
    rename: '重命名',
    save: '保存',
    delete: '删除',
    cancel: '取消',
    retry: '重试',
    previous: '上一页',
    next: '下一页',
  },
  messages: {
    created: '已创建。',
    updated: '已重命名。',
    deleted: '已删除。',
  },
  errors: {
    forbidden: '只有本组织的所有者和管理员可以修改。',
    generic: '请求未能完成，请重试。',
    invalid: '请输入 1 到 255 个字符的名称。',
    invalidResponse: '服务器返回了意外的响应，请重试。',
    notFound: '该 Widget 已不存在。',
    organizationUnavailable: '你无法访问该组织。',
    unavailable: '服务暂时不可用，请稍后重试。',
  },
} as const satisfies LocaleMessageShape<WidgetMessages>;

export default messages;
