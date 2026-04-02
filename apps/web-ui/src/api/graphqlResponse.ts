export type GraphQLErrorItem = {
  message?: string;
};

export type GraphQLResponse<T> = {
  data?: T;
  errors?: GraphQLErrorItem[];
};
