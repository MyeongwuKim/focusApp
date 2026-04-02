import type { GraphQLContext } from "../../graphql/context.js";

type RepositoryConstructor<TRepository> = new (prisma: GraphQLContext["prisma"]) => TRepository;
type ServiceConstructor<TRepository, TService> = new (
  repository: TRepository
) => TService;

export function createServiceFactory<TRepository, TService>(
  RepositoryClass: RepositoryConstructor<TRepository>,
  ServiceClass: ServiceConstructor<TRepository, TService>
) {
  return (context: GraphQLContext) => {
    const repository = new RepositoryClass(context.prisma);
    return new ServiceClass(repository);
  };
}
