import { Route } from "react-router-dom";

import { NothingLayout } from "@/components/layouts/NothingLayout";
import { HeaderLayout } from "@/components/layouts/HeaderLayout";
import { SettingWindowLayout, SettingPage } from "@/components/layouts/SettingWindowLayout";

import { HomePage } from "@/windows/main/HomePage";
import { ProjectPage } from "@/windows/main/ProjectPage";

const publicRoutes = [
	{
		path: "/",
		component: HomePage,
		layout: NothingLayout,
	},
	{
		path: "/project/:id",
		component: ProjectPage,
		layout: HeaderLayout,
	},
	{
		path: "/settings/:tab",
		component: SettingPage,
		layout: SettingWindowLayout,
	},
];

export const renderRoutes = () => (
	<>
		{publicRoutes.map((route, index) => {
			const Page = route.component;
			const Layout = route.layout;

			return (
				<Route
					key={index}
					path={route.path}
					element={
						<Layout>
							<Page />
						</Layout>
					}
				/>
			);
		})}
	</>
);

export { publicRoutes };
